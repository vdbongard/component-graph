export async function getFilesAsync(dataTransfer: DataTransfer) {
  const files: FileWithPath[] = [];
  const entryContentPromises = [];

  // @ts-ignore
  for (const item of dataTransfer.items) {
    if (item.kind === 'file') {
      if (typeof item.webkitGetAsEntry === 'function') {
        const entry = item.webkitGetAsEntry();
        entryContentPromises.push(readEntryContentAsync(entry));
        continue;
      }

      const file = item.getAsFile();
      if (file) {
        // @ts-ignore
        files.push({ file, path: file.webkitRelativePath });
      }
    }
  }

  (await Promise.all(entryContentPromises)).map(entryContent =>
    files.push(...entryContent)
  );

  return files;
}

function readEntryContentAsync(entry: FileSystemEntry) {
  return new Promise<FileWithPath[]>(resolve => {
    let reading = 0;
    const contents: FileWithPath[] = [];

    readEntry(entry);

    function readEntry(fileSystemEntry: FileSystemEntry) {
      if (isFile(fileSystemEntry)) {
        reading++;
        fileSystemEntry.file(file => {
          reading--;
          contents.push({ file, path: fileSystemEntry.fullPath });

          if (reading === 0) {
            resolve(contents);
          }
        });
      } else if (isDirectory(fileSystemEntry)) {
        readReaderContent(fileSystemEntry.createReader());
      }
    }

    function readReaderContent(reader: FileSystemDirectoryReader) {
      reading++;

      reader.readEntries(entries => {
        reading--;
        for (const fileSystemEntry of entries) {
          readEntry(fileSystemEntry);
        }

        if (reading === 0) {
          resolve(contents);
        }
      });
    }
  });
}

function isDirectory(
  entry: FileSystemEntry
): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

function isFile(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

interface FileSystemEntry {
  fullPath: string;
  isFile: boolean;
  isDirectory: boolean;
  name: string;

  getMetadata(
    successCallback: (metadata: Metadata) => void,
    errorCallback?: (error: Error) => void
  ): void;
}

interface FileSystemFileEntry extends FileSystemEntry {
  file(
    successCallback: (file: File) => void,
    errorCallback?: (error: Error) => void
  ): void;
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader(): FileSystemDirectoryReader;
  getDirectory(): FileSystemDirectoryEntry;
  getFile(): FileSystemFileEntry;
}

interface FileSystemDirectoryReader {
  readEntries(
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (error: Error) => void
  ): void;
}

interface Metadata {
  modificationTime: Date;
  size: number;
}

export interface FileWithPath {
  file: File2;
  path: string;
}

interface File2 extends File {
  text?: () => Promise<string>;
}
