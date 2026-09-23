export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => "\\" + c);
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
