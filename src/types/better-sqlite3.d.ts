declare module 'better-sqlite3' {
  namespace DatabaseNS {
    interface Statement {
      run(params?: unknown): unknown;
      get(...args: unknown[]): unknown;
      all(...args: unknown[]): unknown[];
    }
    interface Options {
      fileMustExist?: boolean;
      readonly?: boolean;
      timeout?: number;
    }
    interface Database {
      prepare(sql: string): Statement;
      transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
      pragma(text: string): unknown;
      close(): void;
    }
  }

  class Database implements DatabaseNS.Database {
    constructor(filename: string, options?: DatabaseNS.Options);
    prepare(sql: string): DatabaseNS.Statement;
    transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
    pragma(text: string): unknown;
    close(): void;
    static prototype: DatabaseNS.Database;
  }

  export = Database;
}

