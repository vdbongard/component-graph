import { excludedFolders, supportedExtensions } from '../constants/files';
import { FileWithPath } from './getFilesAsync';

export function isComponentFile(file: FileWithPath): boolean {
  if (excludedFolders.some(folder => file.path.includes(folder))) {
    return;
  }

  const fileParts = file.path.split('.');
  return (
    fileParts.length >= 2 &&
    fileParts[fileParts.length - 2] !== 'test' &&
    supportedExtensions.includes(fileParts[fileParts.length - 1])
  );
}
