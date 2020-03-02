import { FileMap, Graph } from '../interfaces';

export function findReport(
  fullReport: any,
  fileMap: FileMap,
  fileName: string,
  componentName: string,
  functionName?: string
) {
  const component = fileMap[fileName].components[componentName];
  return findReportWithGraph(component.graph, fullReport, fileName, componentName, functionName);
}

export function findReportWithGraph(
  componentGraph: Graph,
  fullReport: any,
  fileName: string,
  componentName: string,
  functionName?: string
) {
  const moduleReport = fullReport.modules.find(module => module.srcPath === fileName);

  if (!moduleReport) {
    console.error('File report not found', fileName);
    return;
  }

  const classReport = moduleReport.classes.find(report => report.name === componentName);

  if (classReport) {
    // ClassComponent
    if (functionName && functionName !== componentName) {
      const classFunctionReport = classReport.methods.find(method => method.name === functionName);

      if (!classFunctionReport) {
        const functionNode = componentGraph.nodes.find(node => node.id === functionName);

        if (!functionNode) {
          return;
        }

        const lineStart = functionNode.lineStart;
        return classReport.methods.find(method => method.lineStart === lineStart);
      }

      return classFunctionReport;
    }
    return classReport;
  } else {
    // FunctionComponent
    let lineStart: number;

    if (!functionName) {
      const componentNode = componentGraph.nodes.find(node => node.label === componentName);

      if (!componentNode) {
        return;
      }

      lineStart = parseInt(componentNode.id.split('#')[1], 10);
    } else if (functionName.includes('#')) {
      lineStart = parseInt(functionName.split('#')[1], 10);
    }

    return moduleReport.methods.find(
      method => method.lineStart === lineStart || method.lineStart === lineStart + 1
    );
  }
}
