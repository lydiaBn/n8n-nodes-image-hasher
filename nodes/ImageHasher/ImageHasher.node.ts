import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
} from 'n8n-workflow';

import * as imageHash from 'image-hash';
import * as fs from 'fs';
import * as path from 'path';

export class ImageHasher implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Image Hasher',
        name: 'imageHasher',
        group: ['transform'],
        version: 1,
        description: 'Generate perceptual hash (pHash) for images',
        defaults: {
            name: 'Image Hasher',
        },
        inputs: ['main'],
        outputs: ['main'],
        icon: 'file:imageHash.svg',
        properties: [
            {
                displayName: 'Binary Property',
                name: 'binaryProperty',
                type: 'string',
                default: 'data',
                required: true,
                description: 'The name of the binary property containing the image',
            },
            {
                displayName: 'Hash Size',
                name: 'hashSize',
                type: 'options',
                options: [
                    { name: '4 bits (16 bits total)', value: 4 },
                    { name: '8 bits (64 bits total)', value: 8 },
                    { name: '16 bits (256 bits total)', value: 16 },
                    { name: '32 bits (1024 bits total)', value: 32 },
                ],
                default: 16,
                description: 'Size of the hash - higher values capture more detail',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
                const hashSize = this.getNodeParameter('hashSize', i) as number;

                const binaryData = items[i].binary?.[binaryProperty];
                if (!binaryData) {
                    throw new NodeOperationError(this.getNode(), `No binary data found in property "${binaryProperty}"`, { itemIndex: i });
                }

                // Save binary image to a temporary file
                const tempDir = '/tmp/n8n-image-hasher';
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                const extension = binaryData.mimeType?.split('/')[1] || 'png';
                const tempPath = path.join(tempDir, `${Date.now()}-${i}.${extension}`);
                const buffer = Buffer.from(binaryData.data, 'base64');
                fs.writeFileSync(tempPath, buffer);

                // Generate perceptual hash (pHash)
                const hash = await new Promise<string>((resolve, reject) => {
                    (imageHash as any).imageHash(tempPath, hashSize, true, (err: any, data: string) => {
                        if (err) reject(err);
                        else resolve(data);
                    });
                });

                // Cleanup temp file
                fs.unlinkSync(tempPath);

                returnData.push({
                    json: {
                        hash,
                        algorithm: 'phash',
                        size: hashSize,
                        totalBits: hashSize * hashSize,
                        createdAt: new Date().toISOString(),
                    },
                });

            } catch (error: any) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: error.message },
                    });
                    continue;
                }
                throw error;
            }
        }

        return [returnData];
    }
}