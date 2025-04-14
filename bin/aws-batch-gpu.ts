#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsBatchGPUStack } from '../lib/aws-batch-gpu-stack';

const app = new cdk.App();
new AwsBatchGPUStack(app, 'AwsBatchGPUStack', {});
cdk.Tags.of(app).add('RepositoryName', 'aws-batch-gpu');