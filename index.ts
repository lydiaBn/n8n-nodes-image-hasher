import { INodeType } from 'n8n-workflow';
import { ImageHasher } from './nodes/ImageHasher/ImageHasher.node';


export const nodeTypes: INodeType[] = [
  new ImageHasher(),
];