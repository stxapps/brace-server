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

  if (!url) {
    return NO_URL;
  }

  url = ensureContainUrlProtocol(url);

  const urlObj = new Url(url, {});
  if (!urlObj.hostname.match(/^([-a-zA-Z0-9@:%_+~#=]{2,256}\.)+[a-z]{2,6}$/)) {
    return ASK_CONFIRM_URL;
  }

  return VALID_URL;
};

const cleanUrl = (url) => {
  const { separatedUrl } = separateUrlAndParam(url, IGNORED_URL_PARAMS);
  return separatedUrl;
};

const cleanTitle = (title) => {
  const separatingCharacters = [' | ', ' _ ', ' - ', '«', '»', '—'];

  title = title.trim();
  for (c of separatingCharacters) {
    const arr = title.split(c);
    if (arr.length > 1) {
      title = arr[0].trim();
    }
  }

  return title;
};

const cleanText = (text) => {
  return text.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
};

module.exports = {
  runAsyncWrapper,
  removeTailingSlash, ensureContainUrlProtocol, validateUrl, cleanUrl,
  cleanTitle, cleanText,
};
