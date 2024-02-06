import express from 'express';
import cors from 'cors';

import dataApi from './data';
import {
  ALLOWED_ORIGINS, N_URLS, VALID_URL, EXTRACT_INIT, EXTRACT_ERROR, EXTRACT_INVALID_URL,
  EXTRACT_EXCEEDING_N_URLS, DERIVED_VALUE,
} from './const';
import {
  runAsyncWrapper, getReferrer, randomString, ensureContainUrlProtocol,
  removeTailingSlash, removeUrlProtocolAndSlashes, isObject, validateUrl, cleanUrl,
  getExtractedResult, deriveExtractedTitle,
} from './utils';
import { manualResults } from './results';

const corsConfig = cors({
  origin: '*',
  // Set the Access-Control-Max-Age header to 365 days.
  maxAge: 60 * 60 * 24 * 365,
});

const app = express();
app.use(corsConfig);
app.use(express.json());

const getOrInitExtractedResult = async (logKey, seq, url) => {

  const result = {
    url: url,
    extractedDT: Date.now(),
  };

  const validatedUrlResult = validateUrl(url);
  console.log(`(${logKey}-${seq}) validatedUrlResult: ${validatedUrlResult}`);
  if (validatedUrlResult !== VALID_URL) {
    console.log(`(${logKey}-${seq}) Invalid url, return ${EXTRACT_INVALID_URL}`);
    result.status = EXTRACT_INVALID_URL;
    return result;
  }

  url = cleanUrl(url);
  const urlKey = removeUrlProtocolAndSlashes(url);
  url = ensureContainUrlProtocol(url);

  result.url = url;

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

  const savedResult = await dataApi.getExtract(urlKey);
  if (savedResult) {
    console.log(`(${logKey}-${seq}) Found savedResult in datastore`);

    // Old records should be removed periodically by a batch job.
    // If records still exist in datastore, means valid can be used
    //   so no need to check here.

    return savedResult;
  }

  console.log(`(${logKey}-${seq}) Not found savedResult in datastore`);
  result.status = EXTRACT_INIT;

  try {
    await dataApi.addExtract(urlKey, result);
    console.log(`(${logKey}-${seq}) Initialised extracted result to datastore`);
  } catch (e) {
    console.log(`(${logKey}-${seq}) datastore.save throws ${e.name}: ${e.message}`);
    result.status = EXTRACT_ERROR;
  }

  return result;
};

app.get('/', (_req, res) => {
  res.send('Welcome to <a href="https://brace.to">Brace.to</a>\'s server!');
});

app.post('/extract', runAsyncWrapper(async (req, res) => {
  const logKey = randomString(12);
  console.log(`(${logKey}) /extract receives a post request`);

  const referrer = getReferrer(req);
  console.log(`(${logKey}) Referrer: ${referrer}`);
  if (!referrer || !ALLOWED_ORIGINS.includes(removeTailingSlash(referrer))) {
    console.log(`(${logKey}) Not expected referrer.`);
  }

  const reqBody = req.body;
  console.log(`(${logKey}) Request body: ${JSON.stringify(reqBody)}`);
  if (!isObject(reqBody)) {
    console.log(`(${logKey}) Invalid reqBody, return ERROR`);
    res.status(500).send('ERROR');
    return;
  }

  const { urls } = reqBody;
  if (!Array.isArray(reqBody.urls)) {
    console.log(`(${logKey}) Invalid urls, return ERROR`);
    res.status(500).send('ERROR');
    return;
  }

  const extractedResults = await Promise.all(
    urls.slice(0, N_URLS).map((url, seq) => getOrInitExtractedResult(logKey, seq, url))
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

app.post('/pre-extract', runAsyncWrapper(async (req, res) => {
  const logKey = randomString(12);
  console.log(`(${logKey}) /pre-extract receives a post request`);

  const referrer = getReferrer(req);
  console.log(`(${logKey}) Referrer: ${referrer}`);
  if (!referrer || !ALLOWED_ORIGINS.includes(removeTailingSlash(referrer))) {
    console.log(`(${logKey}) Not expected referrer.`);
  }

  const reqBody = req.body;
  console.log(`(${logKey}) Request body: ${JSON.stringify(reqBody)}`);
  if (!isObject(reqBody)) {
    console.log(`(${logKey}) Invalid reqBody, return ERROR`);
    res.status(500).send('ERROR');
    return;
  }

  const { urls } = reqBody;
  if (!Array.isArray(urls)) {
    console.log(`(${logKey}) Invalid urls, return ERROR`);
    res.status(500).send('ERROR');
    return;
  }

  await Promise.all(
    urls.slice(0, N_URLS).map((url, seq) => getOrInitExtractedResult(logKey, seq, url))
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
