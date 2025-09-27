import { helloWorld } from './hello-world';

describe('helloWorld', () => {
  it('should return "Hello, World!"', () => {
    expect(helloWorld()).toBe('Hello, World!');
  });
});