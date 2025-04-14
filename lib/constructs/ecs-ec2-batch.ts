import { Construct } from 'constructs';
import { CfnOutput, Duration, RemovalPolicy, Size } from 'aws-cdk-lib';
import { aws_batch as batch } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

export interface EcsEc2BatchProps {
  vpc: ec2.Vpc

}

export class EcsEc2Batch extends Construct {
  constructor(scope: Construct, id: string, props: EcsEc2BatchProps) {
    super(scope, id);

    // Create launch template with increased disk size for GPU instance
    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(200, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true
          })
        },
        {
          deviceName: '/dev/xvdcz',
          volume: ec2.BlockDeviceVolume.ebs(200, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true
          })
        }
      ]
    });

    // Get the GPU-optimized AMI ID for the custom environment
    const ami = ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.GPU);

    // Use the L2 construct for the compute environment
    const computeEnvironment = new batch.ManagedEc2EcsComputeEnvironment(this, 'ComputeEnvironment', {
      vpc: props.vpc,
      maxvCpus: 256,
      minvCpus: 4,
      spot: false,
      allocationStrategy: batch.AllocationStrategy.BEST_FIT_PROGRESSIVE,
      computeEnvironmentName: 'ng-ec2',
      instanceTypes: [
        ec2.InstanceType.of(ec2.InstanceClass.G4DN, ec2.InstanceSize.XLARGE),
      ],
      useOptimalInstanceClasses: false,
      launchTemplate: launchTemplate
    });

    // Access the underlying CfnComputeEnvironment resource
    const cfnComputeEnv = computeEnvironment.node.defaultChild as batch.CfnComputeEnvironment;

    // Set the EC2 Configuration to use GPU-optimized AMI
    cfnComputeEnv.addPropertyOverride('ComputeResources.Ec2Configuration', [
      {
        ImageType: 'ECS_AL2_NVIDIA',
        ImageIdOverride: ami.getImage(this).imageId
      }
    ]);

    // Add required vCPU configuration
    cfnComputeEnv.addPropertyOverride('ComputeResources.DesiredvCpus', 4);

    new batch.JobQueue(this, 'JobQueue', {
      priority: 1,
      computeEnvironments: [
        {
          computeEnvironment: computeEnvironment,
          order: 1
        }
      ],
      jobQueueName: 'queue-ec2'
    })

    // ----- Single Job -----
    const containerDefinition = new batch.EcsEc2ContainerDefinition(this, 'ContainerDefinition', {
      image: ecs.ContainerImage.fromAsset(
        path.resolve(__dirname, "./", "ap/single")
      ),
      cpu: 1,
      memory: Size.mebibytes(8192),
      gpu: 1,
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'single-job',
        logGroup: new logs.LogGroup(this, 'SingleJobLogGroup', {
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_DAY
        })
      })
    })

    const jobDefinition = new batch.EcsJobDefinition(this, 'JobDefinition', {
      container: containerDefinition,
      timeout: Duration.seconds(180),
      retryAttempts: 3,
      jobDefinitionName: 'single-job-definition',
    })

    // Create launch template for spot instances with increased disk size
    const spotLaunchTemplate = new ec2.LaunchTemplate(this, 'SpotLaunchTemplate', {
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(200, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true
          })
        },
        {
          deviceName: '/dev/xvdcz',
          volume: ec2.BlockDeviceVolume.ebs(200, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true
          })
        }
      ]
    });

    const computeEnvironmentSpot = new batch.ManagedEc2EcsComputeEnvironment(this, 'ComputeEnvironmentSpot', {
      vpc: props.vpc,
      maxvCpus: 256,
      minvCpus: 4,
      spot: true,
      spotBidPercentage: 100,
      allocationStrategy: batch.AllocationStrategy.SPOT_CAPACITY_OPTIMIZED,
      computeEnvironmentName: 'ng-spot',
      instanceTypes: [
        ec2.InstanceType.of(ec2.InstanceClass.G4DN, ec2.InstanceSize.XLARGE),
      ],
      useOptimalInstanceClasses: false,
      launchTemplate: spotLaunchTemplate
    })

    // Access the underlying CfnComputeEnvironment resource for spot
    const cfnSpotComputeEnv = computeEnvironmentSpot.node.defaultChild as batch.CfnComputeEnvironment;

    // Set the EC2 Configuration to use GPU-optimized AMI for spot instances
    cfnSpotComputeEnv.addPropertyOverride('ComputeResources.Ec2Configuration', [
      {
        ImageType: 'ECS_AL2_NVIDIA',
        ImageIdOverride: ami.getImage(this).imageId
      }
    ]);

    // Add required vCPU configuration for spot
    cfnSpotComputeEnv.addPropertyOverride('ComputeResources.DesiredvCpus', 4);

    new batch.JobQueue(this, 'JobQueueSpot', {
      priority: 1,
      computeEnvironments: [
        {
          computeEnvironment: computeEnvironmentSpot,
          order: 1
        }
      ],
      jobQueueName: 'queue-spot'
    })
  }
}