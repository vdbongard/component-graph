export function nestedStringAccess(value: object, accessorString: string) {
  return accessorString.split('.').reduce((o, i) => o[i], value);
}
