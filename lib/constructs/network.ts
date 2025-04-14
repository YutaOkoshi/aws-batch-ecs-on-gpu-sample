import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

export interface NetworkProps {

}

export class Network extends Construct {
  public readonly vpc: ec2.Vpc
  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      natGateways: 1
    })

    this.vpc = vpc

  }
}