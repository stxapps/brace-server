const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const {
  runAsyncWrapper,
  removeTailingSlash, validateUrl, cleanUrl,
  ensureContainUrlProtocol,
  cleanTitle, cleanText,
} = require('./utils');
const {
  ALLOWED_ORIGINS, N_URLS, VALID_URL,
  PAGE_WIDTH, PAGE_HEIGHT,
  EXTRACT_OK, EXTRACT_ERROR, EXTRACT_INVALID_URL, EXTRACT_EXCEEDING_N_URLS,
} = require('./const');

const app = express();
app.use(express.json());

const extractCorsOptions = {
  'origin': ALLOWED_ORIGINS,
}

let browser;



const _extract = async (url) => {

  const res = {};

  if (!browser) browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  await page.goto(ensureContainUrlProtocol(url), { waitUntil: 'networkidle0' });

  // TODO: Try to get title and image from twitter tags and open graph tags

  const text = cleanText(await page.evaluate(() => {
    const el = [...document.getElementsByTagName('h1')][0];
    if (!el) return '';

    const text = 'innerText' in el ? 'innerText' : 'textContent';
    return el[text];
  }));
  if (text.length >= 10) res.title = text;
  if (!res.title) {
    const text = cleanText(await page.evaluate(() => {
      const el = [...document.getElementsByTagName('h2')][0];
      if (!el) return '';

      const text = 'innerText' in el ? 'innerText' : 'textContent';
      return el[text];
    }));
    if (text.length >= 10) res.title = text;
  }
  if (!res.title) {
    const title = await page.title();
    const cleansedTitle = cleanText(cleanTitle(title));
    if (cleansedTitle.length >= 10) res.title = cleansedTitle;
    else res.title = cleanText(title);
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

const extract = async (url) => {

  const validatedResult = validateUrl(url);
  if (validatedResult !== VALID_URL) {
    return {
      url: url,
      status: EXTRACT_INVALID_URL,
      extractedDT: Date.now(),
    };
  }

  // Clean up the url
  url = cleanUrl(url);

  // Try to get from memCache


  // Try to get from DataStore
  //   If too old, ignore
  //   If found, save to memCache

  // Try to get from puppeteer
  //   Save to DataStore and Memcache
  let title, image;
  try {
    ({ title, image } = await _extract(url));
    console.log(`Extracted title: ${title}`);
  } catch (e) {
    console.log(`Puppeteer throws an error: ${e}`);
    return {
      url: url,
      status: EXTRACT_ERROR,
      extractedDT: Date.now(),
    }
  }

  // Save image to db

  const extractedResult = {
    url: url,
    status: EXTRACT_OK,
    title: title,
    //image: imagePath,
    extractedDT: Date.now(),
  }


  // Save to datastore and memcache

  return extractedResult;
};

app.get('/', (req, res) => {
  res.status(200).send('Welcome to Brace.to\'s server!').end();
});

app.options('/extract', cors(extractCorsOptions));
app.post('/extract', cors(extractCorsOptions), runAsyncWrapper(async (req, res) => {
  console.log(`/extract receives a post request`);

  const referrer = req.get('Referrer');
  console.log(`Referrer: ${referrer}`);
  if (!referrer || !ALLOWED_ORIGINS.includes(removeTailingSlash(referrer))) {
    console.log('Invalid referrer, throw error');
    throw new Error('Invalid referrer');
  }

  const reqBody = req.body;
  console.log('Request body:');
  console.log(reqBody);
  if (typeof reqBody !== 'object' || !Array.isArray(reqBody.urls)) {
    console.log('Invalid req.body, throw error');
    throw new Error('Invalid request body');
  }

  const { urls } = reqBody;

  const extractedResults = await Promise.all(
    urls.slice(0, N_URLS).map(url => extract(url))
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

  res.send(JSON.stringify(results));
}));

// Listen to the App Engine-specified port, or 8088 otherwise
const PORT = process.env.PORT || 8088;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
  console.log('Press Ctrl+C to quit.');
});
