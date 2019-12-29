export function SetToJSON(key, value) {
  if (typeof value === 'object' && value instanceof Set) {
    return [...value];
  }
  return value;
}

export function JSONToSet(key, value) {
  if (key === 'dependencies' && value instanceof Array) {
    return new Set(value);
  }
  return value;
}
