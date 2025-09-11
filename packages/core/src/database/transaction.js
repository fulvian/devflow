export function withTransaction(db, fn) {
    const tx = db.transaction(fn);
    return tx();
}
//# sourceMappingURL=transaction.js.map