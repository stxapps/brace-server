import { Datastore } from '@google-cloud/datastore';

import { EXTRACT } from './const';

const datastore = new Datastore();

const addExtract = (urlKey, extractData) => {
  return datastore.save({
    key: datastore.key([EXTRACT, urlKey]),
    data: deriveExtractEntity(extractData),
  });
};

const getExtract = async (urlKey) => {
  const [entity] = await datastore.get(datastore.key([EXTRACT, urlKey]));
  if (!entity) return null;

  return deriveExtractData(entity);
};

const deriveExtractEntity = (extractData) => {
  const entity = [
    { name: 'url', value: extractData.url, excludeFromIndexes: true },
    { name: 'status', value: extractData.status },
  ];

  if ('title' in extractData) {
    entity.push({
      name: 'title', value: extractData.title, excludeFromIndexes: true,
    });
  }
  if ('image' in extractData) {
    entity.push({
      name: 'image', value: extractData.image, excludeFromIndexes: true,
    });
  }
  if ('favicon' in extractData) {
    entity.push({
      name: 'favicon', value: extractData.favicon, excludeFromIndexes: true,
    });
  }

  entity.push({ name: 'extractDate', value: new Date(extractData.extractedDT) });

  return entity;
};

const deriveExtractData = (extractEntity) => {
  const data = {
    url: extractEntity.url,
    status: extractEntity.status,
  };

  if ('title' in extractEntity) data.title = extractEntity.title;
  if ('image' in extractEntity) data.image = extractEntity.image;
  if ('favicon' in extractEntity) data.favicon = extractEntity.favicon;

  data.extractedDT = extractEntity.extractDate.getTime();

  return data;
};

const data = { addExtract, getExtract };

export default data;
