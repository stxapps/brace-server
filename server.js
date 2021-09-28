const express = require('express');
const cors = require('cors');
const { Datastore } = require('@google-cloud/datastore');

const {
  runAsyncWrapper, randomString,
  ensureContainUrlProtocol, removeTailingSlash, removeUrlProtocolAndSlashes,
  validateUrl, cleanUrl, getExtractedResult, deriveExtractedTitle,
} = require('./utils');
const {
  DATASTORE_KIND,
  ALLOWED_ORIGINS, N_URLS, VALID_URL,
  EXTRACT_INIT, EXTRACT_ERROR, EXTRACT_INVALID_URL, EXTRACT_EXCEEDING_N_URLS,
  DERIVED_VALUE,
} = require('./const');
const { manualResults } = require('./results');

const datastore = new Datastore();

const app = express();
app.use(express.json());

const extractCorsOptions = {
  'origin': ALLOWED_ORIGINS,
}

const getOrInitExtractedResult = async (url, logKey, seq) => {

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

  const manualResult = getExtractedResult(manualResults, urlKey);
  if (manualResult) {
    console.log(`(${logKey}-${seq}) Found in manualResults`);
    if (manualResult.url === DERIVED_VALUE) {
      manualResult.url = url;
    }
    if (manualResult.title === DERIVED_VALUE) {
      manualResult.title = deriveExtractedTitle(urlKey);
    }
    return manualResult;
  }

  const savedResult = (await datastore.get(datastore.key([DATASTORE_KIND, urlKey])))[0];
  if (savedResult) {
    console.log(`(${logKey}-${seq}) Found savedResult in datastore`);

    // Old records should be removed periodically by a batch job.
    // If records still exist in datastore, means valid can be used
    //   so no need to check here.

    return savedResult;
  }

  console.log(`(${logKey}-${seq}) Not found savedResult in datastore`);
  extractedResult.status = EXTRACT_INIT;

  try {
    await datastore.save({
      key: datastore.key([DATASTORE_KIND, urlKey]),
      data: extractedResult,
    });
    console.log(`(${logKey}-${seq}) Initialised extracted result to datastore`);
  } catch (e) {
    console.log(`(${logKey}-${seq}) datastore.save throws ${e.name}: ${e.message}`);
    extractedResult.status = EXTRACT_ERROR;
  }

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
    urls.slice(0, N_URLS).map((url, seq) => getOrInitExtractedResult(url, logKey, seq))
  );

  const results = { extractedResults: [] };
  extractedResults.forEach(result => results.extractedResults.push(result));
  urls.slice(N_URLS).forEach(url => results.extractedResults.push({
    url: url,
    status: EXTRACT_EXCEEDING_N_URLS,
    extractedDT: Date.now(),
  }));

  console.log(`(${logKey}) /extract finished: ${JSON.stringify(results)}`);
  res.send(JSON.stringify(results));
}));

app.options('/pre-extract', cors(extractCorsOptions));
app.post('/pre-extract', cors(extractCorsOptions), runAsyncWrapper(async (req, res) => {
  const logKey = randomString(12);
  console.log(`(${logKey}) /pre-extract receives a post request`);

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

  await Promise.all(
    urls.slice(0, N_URLS).map((url, seq) => getOrInitExtractedResult(url, logKey, seq))
  );

  const results = { status: 'pre-extracted' };

  console.log(`(${logKey}) /pre-extract finished: ${JSON.stringify(results)}`);
  res.send(JSON.stringify(results));
}));

// Listen to the App Engine-specified port, or 8088 otherwise
const PORT = process.env.PORT || 8088;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
  console.log('Press Ctrl+C to quit.');
});
