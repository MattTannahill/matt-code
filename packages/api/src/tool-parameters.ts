import { ToolProperty } from './tool-property.js';

export interface ToolParameters {
  [key: string]: any;
  type: 'object';
  properties: {
    [key: string]: ToolProperty;
  };
  required: string[];
}
