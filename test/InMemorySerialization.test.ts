import { strict as assert } from 'node:assert';
import InMemoryDbCollection from '../connectors/inmemory/InMemoryDbCollection.js';
import InMemoryDbIndex from '../connectors/inmemory/InMemoryDbIndex.js';
import { InMemoryDb } from '../connectors/inmemory/InMemoryDb.js';

describe('In-memory serialization', function () {
    it('writes database container types to the output without mutating live containers', function () {
        const db = Object.create(InMemoryDb.prototype) as InMemoryDb;
        const index = new InMemoryDbIndex('index');
        index.__type = 'existing-type';
        const collection = new InMemoryDbCollection('collection');
        (db as any).indexes = { index, collection };
        const json = db.toJsonObject();
        assert.equal(json.indexes.index.__type, 'Index');
        assert.equal(json.indexes.collection.__type, 'Collection');
        assert.equal(index.__type, 'existing-type');
        assert.equal(Object.hasOwn(collection, '__type'), false);
    });
});
