# Build stage
FROM 763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-training:2.0.1-gpu-py310-cu118-ubuntu20.04-ec2

# Create an entrypoint script
RUN echo '#!/bin/bash\n\
echo "Starting container..."\n\
if command -v nvidia-smi &> /dev/null; then\n\
    echo "NVIDIA GPU detected, running nvidia-smi:"\n\
    nvidia-smi\n\
else\n\
    echo "NVIDIA GPU not available or drivers not properly configured"\n\
    echo "System information:"\n\
    uname -a\n\
fi\n\
echo "Container is running."\n\
# Keep container running\n\
tail -f /dev/null' > /entrypoint.sh

# Make entrypoint script executable
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
