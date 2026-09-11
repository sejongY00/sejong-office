pipeline {
  agent any

  environment {
    NODE_OPTIONS = '--max-old-space-size=8192'
    NODE_IMAGE = 'node:22-bookworm'
    REGISTRY = 'docker.sejong.dev'
    IMAGE = 'docker.sejong.dev/sejong-office'
    SSH_CONFIG_NAME = 'SEJONG-NAS'
    DEPLOY_DIR = '/volume1/docker/sejong-office'
  }

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  stages {
    stage('Type-check & Build') {
      steps {
        sh '''
          set -eu
          docker run --rm \
            -u "$(id -u):$(id -g)" \
            -e HOME=/tmp \
            -e NODE_OPTIONS \
            -v "$PWD":/app \
            -w /app \
            "$NODE_IMAGE" \
            bash -lc 'npm ci && npm run build'
        '''
      }
    }

    stage('Release') {
      when {
        allOf {
          not { changeRequest() }
          anyOf {
            branch 'main'
            expression {
              def branch = env.GIT_BRANCH ?: env.BRANCH_NAME ?: ''
              branch == 'main' || branch == 'origin/main' || branch == 'refs/heads/main'
            }
          }
        }
      }
      stages {
        stage('Build & Push image') {
          steps {
            withCredentials([usernamePassword(
              credentialsId: 'docker-sejong-dev',
              usernameVariable: 'REGISTRY_USERNAME',
              passwordVariable: 'REGISTRY_PASSWORD'
            )]) {
              sh '''
                set -eu
                echo "$REGISTRY_PASSWORD" | docker login "$REGISTRY" -u "$REGISTRY_USERNAME" --password-stdin
                docker build -t "$IMAGE:latest" -t "$IMAGE:sha-${GIT_COMMIT}" .
                docker push "$IMAGE:latest"
                docker push "$IMAGE:sha-${GIT_COMMIT}"
              '''
            }
          }
          post {
            always {
              sh 'docker logout "$REGISTRY" || true'
            }
          }
        }

        stage('Deploy') {
          steps {
            sshPublisher(
              failOnError: true,
              publishers: [
                sshPublisherDesc(
                  configName: env.SSH_CONFIG_NAME,
                  verbose: true,
                  transfers: [
                    sshTransfer(
                      execTimeout: 1800000,
                      usePty: true,
                      execCommand: """
                        sudo -n su -c 'set -eu; cd "${env.DEPLOY_DIR}"; docker compose pull; docker compose up -d'
                      """.stripIndent().trim()
                    )
                  ]
                )
              ]
            )
          }
        }
      }
    }
  }
}
