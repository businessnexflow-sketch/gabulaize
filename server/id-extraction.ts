export type N8nIdResult = {
  firstName?: string;
  lastName?: string;
  personalId?: string;
};

export type ExtractedIdData = {
  firstName?: string;
  lastName?: string;
  idNumber?: string;
};

export function mapN8nResultToIdData(result: N8nIdResult): ExtractedIdData {
  return {
    firstName: result.firstName,
    lastName: result.lastName,
    idNumber: result.personalId,
  };
}

export function stripDataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf("base64,");
  if (idx === -1) return dataUrl.trim();
  return dataUrl.slice(idx + "base64,".length).trim();
}
