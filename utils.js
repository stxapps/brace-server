const Url = require('url-parse');

const {
  HTTP,
  VALID_URL, NO_URL, ASK_CONFIRM_URL,
  IGNORED_URL_PARAMS,
} = require('./const');

const runAsyncWrapper = (callback) => {
  return function (req, res, next) {
    callback(req, res, next).catch(next);
  }
};

const randomString = (length) => {

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const removeTailingSlash = (url) => {
  if (url.slice(-1) === '/') return url.slice(0, -1);
  return url;
};

const containUrlProtocol = (url) => {
  const urlObj = new Url(url, {});
  return urlObj.protocol && urlObj.protocol !== '';
};

const ensureContainUrlProtocol = (url) => {
  if (!containUrlProtocol(url)) return HTTP + url;
  return url;
};

const removeUrlProtocolAndSlashes = (url) => {

  let doSlice = false, sliceIndex = 0;
  for (let i = 0; i < url.length; i++) {
    if (url[i] === ':') {
      doSlice = true;
      sliceIndex = i + 1;
      break;
    }
    if (url[i] === '.') {
      doSlice = false;
      break;
    }
    if (url[i] === '/') {
      doSlice = true;
      sliceIndex = i;
      break;
    }
  }

  if (!doSlice) return url;

  url = url.slice(sliceIndex);

  sliceIndex = 0;
  for (; sliceIndex < url.length; sliceIndex++) {
    if (url[sliceIndex] !== '/') break;
  }

  return url.slice(sliceIndex);
};

const separateUrlAndParam = (url, paramKey) => {

  const doContain = containUrlProtocol(url);
  url = ensureContainUrlProtocol(url);

  const urlObj = new Url(url, {}, true);

  const newQuery = {}, param = {};
  for (const key in urlObj.query) {
    if (Array.isArray(paramKey)) {
      if (paramKey.includes(key)) {
        param[key] = urlObj.query[key];
      } else {
        newQuery[key] = urlObj.query[key];
      }
    } else {
      if (key === paramKey) {
        param[key] = urlObj.query[key];
      } else {
        newQuery[key] = urlObj.query[key];
      }
    }
  }

  urlObj.set('query', newQuery);

  let separatedUrl = urlObj.toString();
  if (!doContain) {
    separatedUrl = separatedUrl.substring(HTTP.length);
  }

  return { separatedUrl, param };
};

const validateUrl = (url) => {

  if (!url) return NO_URL;

  if (/\s/g.test(url)) return ASK_CONFIRM_URL;
  // Buffer's only available in NodeJs, but not in web browsers.
  if (Buffer.byteLength(url, 'utf8') >= 1500) return ASK_CONFIRM_URL;

  url = ensureContainUrlProtocol(url);

  const urlObj = new Url(url, {});
  if (!urlObj.hostname.match(/^([-a-zA-Z0-9@:%_+~#=]{1,256}\.)+[a-z]{2,6}$/)) {
    return ASK_CONFIRM_URL;
  }

  return VALID_URL;
};

const cleanUrl = (url) => {
  const { separatedUrl } = separateUrlAndParam(url, IGNORED_URL_PARAMS);
  return removeTailingSlash(separatedUrl);
};

const cleanText = (text) => {
  return text.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
};

module.exports = {
  runAsyncWrapper, randomString,
  ensureContainUrlProtocol, removeTailingSlash, removeUrlProtocolAndSlashes,
  validateUrl,
  cleanUrl, cleanText,
};
