import { parse as babelParse, ParserOptions } from '@babel/parser';

export function parse(code: string, fileName?: string) {
  const fileExtension = fileName.split('.').pop();

  const options: ParserOptions = {
    sourceType: 'module',
    plugins: [
      'asyncGenerators',
      'bigInt',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      ['decorators', { decoratorsBeforeExport: false }],
      'doExpressions',
      'dynamicImport',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'functionBind',
      'functionSent',
      'importMeta',
      'jsx',
      'logicalAssignment',
      'nullishCoalescingOperator',
      'numericSeparator',
      'objectRestSpread',
      'optionalCatchBinding',
      'optionalChaining',
      ['pipelineOperator', { proposal: 'minimal' }],
      'throwExpressions'
    ]
  };

  if (fileExtension === 'tsx' || fileExtension === 'ts') {
    options.plugins.push('typescript');
  } else {
    options.plugins.push('flow');
  }

  return babelParse(code, options);
}
