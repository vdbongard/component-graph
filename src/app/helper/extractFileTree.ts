import { FileMap, FileTree } from '../interfaces';

export function extractFileTree(fileMap: FileMap): FileTree[] {
  if (!fileMap) {
    return [];
  }

  const fileNames = Object.keys(fileMap);
  const fileTrees: FileTree[] = [];

  for (const fileName of fileNames) {
    const parts = fileName.split('/');
    parts.shift(); // remove first empty string element (fileName always starts with '/')

    const leaf: FileTree = {
      name: parts.pop(),
      id: fileName,
      type: 'file'
    };

    let index = 0;
    let innerTree: FileTree = fileTrees.find(node => node.name === parts[0]);
    let folderIsMissing = !innerTree;

    if (innerTree) {
      // search the tree for nested folders
      for (let i = 1; i < parts.length; i++) {
        if (!innerTree.children) {
          folderIsMissing = true;
          break;
        }
        index = i;
        const folderName = parts[i];
        const newInnerTree = innerTree.children.find(
          node => node.name === folderName && node.type === 'folder'
        );
        if (!newInnerTree) {
          folderIsMissing = true;
          break;
        }
        innerTree = newInnerTree;
      }
    }

    // a folder was not found so we need to create all missing ones
    if (folderIsMissing) {
      if (!innerTree) {
        innerTree = {
          name: parts[index],
          type: 'folder'
        };
        fileTrees.push(innerTree);
        index++;
      }

      while (index < parts.length) {
        const folder: FileTree = {
          name: parts[index],
          type: 'folder'
        };

        if (!innerTree.children) {
          innerTree.children = [folder];
        } else {
          innerTree.children.push(folder);
        }

        innerTree = folder;
        index++;
      }
    }

    if (!innerTree.children) {
      innerTree.children = [leaf];
    } else {
      innerTree.children.push(leaf);
    }
  }

  return sortFileTrees(fileTrees);
}

function sortFileTrees(fileTrees: FileTree[]) {
  fileTrees.forEach(fileTree => {
    if (fileTree.children) {
      sortFileTrees(fileTree.children);
    }
  });
  return fileTrees.sort(sortFilesAndFolders);
}

function sortFilesAndFolders(a: FileTree, b: FileTree) {
  if (a.type === 'folder' && b.type !== 'folder') {
    return -1;
  }

  if (a.type !== 'folder' && b.type === 'folder') {
    return 1;
  }

  if (a.name.toLowerCase() > b.name.toLowerCase()) {
    return 1;
  }
  if (a.name.toLowerCase() < b.name.toLowerCase()) {
    return -1;
  }

  return 0;
}
