const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { Datastore } = require('@google-cloud/datastore');
const { Storage } = require('@google-cloud/storage');

const {
  runAsyncWrapper, randomString,
  ensureContainUrlProtocol, removeTailingSlash, removeUrlProtocolAndSlashes,
  validateUrl,
  cleanUrl, cleanText,
} = require('./utils');
const {
  DATASTORE_KIND, BUCKET_NAME,
  ALLOWED_ORIGINS, N_URLS, VALID_URL,
  PAGE_WIDTH, PAGE_HEIGHT,
  EXTRACT_OK, EXTRACT_ERROR, EXTRACT_INVALID_URL, EXTRACT_EXCEEDING_N_URLS,
} = require('./const');

const datastore = new Datastore();

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

const app = express();
app.use(express.json());

const extractCorsOptions = {
  'origin': ALLOWED_ORIGINS,
}

let browser;

const saveImage = (image) => new Promise((resolve, reject) => {

  const fname = randomString(48) + '.png';
  const blob = bucket.file(fname);
  const blobStream = blob.createWriteStream({
    resumable: false,
  });
  blobStream.on('finish', () => {
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
    resolve(publicUrl);
  });
  blobStream.on('error', (e) => {
    reject(e);
  });
  blobStream.end(image);
});

const _extract = async (url) => {

  const res = {};

  if (!browser) browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  await page.goto(url, { waitUntil: 'networkidle0' });

  // TODO: Try to get title and image from twitter tags and open graph tags

  const text = await page.evaluate(() => {
    const el = [...document.getElementsByTagName('h1')][0];
    if (!el) return null;

    const text = 'innerText' in el ? 'innerText' : 'textContent';
    return el[text];
  });
  if (text !== null) {
    const cleansedText = cleanText(text);
    if (cleansedText.length >= 10) res.title = cleansedText;
  } else {
    const text = await page.evaluate(() => {
      const el = [...document.getElementsByTagName('h2')][0];
      if (!el) return null;

      const text = 'innerText' in el ? 'innerText' : 'textContent';
      return el[text];
    });
    if (text !== null) {
      const cleansedText = cleanText(text);
      if (cleansedText.length >= 10) res.title = cleansedText;
    }
  }
  if (!res.title) {
    const title = await page.title();
    res.title = cleanText(title);
  }

  const img = await page.evaluateHandle(() => {
    return [...document.getElementsByTagName('img')].sort(
      (a, b) => b.width * b.height - a.width * a.height
    )[0];
  });
  if (img) {
    const [imgWidth, imgHeight] = await img.evaluate(elem => [elem.width, elem.height]);
    const imgRatio = imgWidth / imgHeight;
    if (imgWidth > PAGE_WIDTH * 0.4 && (imgRatio >= 1.6 && imgRatio < 1.94)) {
      res.image = await img.screenshot();
    }
    await img.dispose();
  }
  if (!res.image) res.image = await page.screenshot();

  await page.close();
  return res;
};

const extract = async (url, logKey, seq) => {

  const extractedResult = {
    url: url,
    extractedDT: Date.now(),
  };

  const validatedUrlResult = validateUrl(url);
  console.log(`(${logKey}-${seq}) validatedUrlResult: ${validatedUrlResult}`);
  if (validatedUrlResult !== VALID_URL) {
    console.log(`(${logKey}-${seq}) Invalid url, return ${EXTRACT_INVALID_URL}`);
    extractedResult.status = EXTRACT_INVALID_URL;
    return extractedResult;
  }

  url = cleanUrl(url);
  const urlKey = removeUrlProtocolAndSlashes(url);
  url = ensureContainUrlProtocol(url);

  extractedResult.url = url;

  const savedResult = (await datastore.get(datastore.key([DATASTORE_KIND, urlKey])))[0];
  if (savedResult) {
    console.log(`(${logKey}-${seq}) Found savedResult in datastore`);

    // Old records should be removed periodically by a batch job.
    // If records still exist in datastore, means valid can be used
    //   so no need to check here.

    return savedResult;
  }

  let title, image, ok = false;
  try {
    ({ title, image } = await _extract(url));
    console.log(`(${logKey}-${seq}) _extract finished`);
    ok = true;
  } catch (e) {
    console.log(`(${logKey}-${seq}) _extract throws ${e.name}: ${e.message}`);
    extractedResult.status = EXTRACT_ERROR;
  }

  if (ok) {
    const imageUrl = await saveImage(image);
    console.log(`(${logKey}-${seq}) Saved image at ${imageUrl}`);

    extractedResult.status = EXTRACT_OK;
    extractedResult.title = title;
    extractedResult.image = imageUrl;
  }

  await datastore.save({
    key: datastore.key([DATASTORE_KIND, urlKey]),
    data: extractedResult,
  });
  console.log(`(${logKey}-${seq}) Saved extracted result to datastore`);

  return extractedResult;
};

app.get('/', (_req, res) => {
  res.status(200).send('Welcome to <a href="https://brace.to">Brace.to</a>\'s server!').end();
});

app.options('/extract', cors(extractCorsOptions));
app.post('/extract', cors(extractCorsOptions), runAsyncWrapper(async (req, res) => {
  const logKey = randomString(12);
  console.log(`(${logKey}) /extract receives a post request`);

  const referrer = req.get('Referrer');
  console.log(`(${logKey}) Referrer: ${referrer}`);
  if (!referrer || !ALLOWED_ORIGINS.includes(removeTailingSlash(referrer))) {
    console.log(`(${logKey}) Invalid referrer, throw error`);
    throw new Error('Invalid referrer');
  }

  const reqBody = req.body;
  console.log(`(${logKey}) Request body: ${JSON.stringify(reqBody)}`);
  if (typeof reqBody !== 'object' || !Array.isArray(reqBody.urls)) {
    console.log(`(${logKey}) Invalid req.body, throw error`);
    throw new Error('Invalid request body');
  }

  const { urls } = reqBody;

  const extractedResults = await Promise.all(
    urls.slice(0, N_URLS).map((url, seq) => extract(url, logKey, seq))
  );

  results = {
    extractedResults: [],
  };
  extractedResults.forEach(result => results.extractedResults.push(result));
  urls.slice(N_URLS).forEach(url => results.extractedResults.push({
    url: url,
    status: EXTRACT_EXCEEDING_N_URLS,
    extractedDT: Date.now(),
  }));

  console.log(`(${logKey}) /extract finished: ${JSON.stringify(results)}`);
  res.send(JSON.stringify(results));
}));

// Listen to the App Engine-specified port, or 8088 otherwise
const PORT = process.env.PORT || 8088;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
  console.log('Press Ctrl+C to quit.');
});
