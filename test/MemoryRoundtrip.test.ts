import { strict as assert } from 'node:assert';
import { MemoryAddress } from '../src/memory/MemoryAddress.js';
import { MemoryBlock } from '../src/memory/MemoryBlock.js';
import { MemoryLayout } from '../src/memory/MemoryLayout.js';

describe('Memory layout roundtrip', function () {
    it('returns the reconstructed layout and its blocks', function () {
        const layout = new MemoryLayout();
        layout.addBlock(MemoryBlock.fromAddressRange(new MemoryAddress(16n), new MemoryAddress(32n)));
        const restored = MemoryLayout.fromJsonObject(layout.toJsonObject());
        assert.ok(restored instanceof MemoryLayout);
        assert.deepEqual(restored.toJsonObject(), layout.toJsonObject());
    });

});
