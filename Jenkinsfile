
pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo 'EcoTrack source code checked out from GitHub'
            }
        }

        stage('Verify Project') {
            steps {
                sh '''
                    echo "Checking EcoTrack project structure"
                    ls -la
                    test -d frontend
                    test -d backend
                    echo "Frontend and backend folders found!"
                '''
            }
        }
    }

    post {
        success {
            echo 'EcoTrack Jenkins pipeline completed successfully!'
        }
        failure {
            echo 'EcoTrack pipeline failed. Check the console output.'
        }
    }
}
