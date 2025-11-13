import { ComplexClassToSplit, DataClassModel } from './complex.js';

export class Consumer {
    complex: ComplexClassToSplit;
    data: DataClassModel;

    process(): void {
        const temp = new ComplexClassToSplit();
        const value = new DataClassModel();
    }
}
