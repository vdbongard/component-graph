import { Pipe, PipeTransform } from '@angular/core';
import { nestedStringAccess } from '../helper/nestedStringAccess';

@Pipe({
  name: 'nestedStringAccessor'
})
export class NestedStringAccessorPipe implements PipeTransform {
  /**
   * Access an object via dot-syntax e.g. object['foo.bar'] -> object['foo']['bar']
   * Usage: myObject | nestedStringAccessor: 'foo.bar'
   *
   * @param value The object to access
   * @param accessorString The accessor string in the format of 'foo.bar'
   */
  transform(value: object, accessorString: string): unknown {
    return nestedStringAccess(value, accessorString);
  }
}
