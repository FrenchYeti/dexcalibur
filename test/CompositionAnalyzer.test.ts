import {expect} from 'chai';
import {CompositionAnalyzer} from '../src/analyzer/CompositionAnalyzer.js';

describe('CompositionAnalyzer context and namespace filtering', () => {
    it('retains the configured context', () => {
        const context = {} as any;
        expect(new CompositionAnalyzer({ctx: context}).ctx).to.equal(context);
    });
});
