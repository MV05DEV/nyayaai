export async function deleteCaseRecord(client, id) {
  return client.$transaction(async transaction => {
    const existing = await transaction.case.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return false;
    await transaction.message.deleteMany({ where: { caseId: id } });
    await transaction.evidence.deleteMany({ where: { caseId: id } });
    await transaction.generatedDocument.deleteMany({ where: { caseId: id } });
    await transaction.case.delete({ where: { id } });
    return true;
  });
}

export async function clearCaseRecords(client) {
  return client.$transaction(async transaction => {
    const cases = await transaction.case.findMany({ select: { id: true } });
    const caseIds = cases.map(item => item.id);
    if (!caseIds.length) return 0;
    await transaction.message.deleteMany({ where: { caseId: { in: caseIds } } });
    await transaction.evidence.deleteMany({ where: { caseId: { in: caseIds } } });
    await transaction.generatedDocument.deleteMany({ where: { caseId: { in: caseIds } } });
    const deleted = await transaction.case.deleteMany({ where: { id: { in: caseIds } } });
    return deleted.count;
  });
}
