#!/bin/bash

# SayItRight API - EC2 배포 스크립트
# 사용법: ./deploy-to-ec2.sh

set -e  # 에러 발생 시 스크립트 중단

EC2_IP="43.201.99.231"
EC2_USER="ubuntu"
KEY_PATH="$HOME/.ssh/sayitright-ec2-key.pem"
PROJECT_DIR="sayitright-api"

echo "🚀 SayItRight API 배포 시작..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. EC2 접속 확인
echo ""
echo "📡 1/6: EC2 접속 확인 중..."
if ssh -i "$KEY_PATH" -o ConnectTimeout=10 "$EC2_USER@$EC2_IP" "exit" 2>/dev/null; then
    echo "   ✅ EC2 접속 성공"
else
    echo "   ❌ EC2 접속 실패"
    echo "   보안 그룹에서 현재 IP가 SSH 접근 가능한지 확인하세요."
    exit 1
fi

# 2. 환경 설정 확인
echo ""
echo "⚙️  2/6: 환경 설정 확인 중..."
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_IP" << 'ENDSSH'
    # Node.js 설치 확인
    if ! command -v node &> /dev/null; then
        echo "   📦 Node.js 설치 중..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "   ✅ Node.js 이미 설치됨: $(node --version)"
    fi

    # PM2 설치 확인
    if ! command -v pm2 &> /dev/null; then
        echo "   📦 PM2 설치 중..."
        sudo npm install -g pm2
    else
        echo "   ✅ PM2 이미 설치됨: $(pm2 --version)"
    fi

    # Git 설치 확인
    if ! command -v git &> /dev/null; then
        echo "   📦 Git 설치 중..."
        sudo apt-get update
        sudo apt-get install -y git
    else
        echo "   ✅ Git 이미 설치됨: $(git --version)"
    fi
ENDSSH

echo "   ✅ 환경 설정 완료"

# 3. 코드 배포
echo ""
echo "📥 3/6: 코드 배포 중..."
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_IP" << ENDSSH
    # 프로젝트 디렉토리 확인
    if [ -d "$PROJECT_DIR" ]; then
        echo "   🔄 기존 코드 업데이트 중..."
        cd $PROJECT_DIR
        git fetch origin main
        git reset --hard origin/main
    else
        echo "   📥 코드 클론 중..."
        git clone https://github.com/kw9212/sayitright-api.git
        cd $PROJECT_DIR
    fi

    # 의존성 설치 (빌드를 위해 모든 의존성 설치)
    echo "   📦 의존성 설치 중..."
    CI=true npm install
ENDSSH

echo "   ✅ 코드 배포 완료"

# 4. 환경변수 파일 전송
echo ""
echo "🔐 4/6: 환경변수 설정 중..."
if [ -f ".env" ]; then
    # NODE_ENV를 production으로 변경
    sed 's/NODE_ENV=development/NODE_ENV=production/' .env > .env.production.tmp
    
    # .env 파일 전송
    scp -i "$KEY_PATH" .env.production.tmp "$EC2_USER@$EC2_IP:~/$PROJECT_DIR/.env"
    rm .env.production.tmp
    echo "   ✅ 환경변수 파일 전송 완료"
else
    echo "   ⚠️  .env 파일이 없습니다. EC2에서 수동으로 생성해야 합니다."
fi

# 5. Prisma 설정 및 빌드
echo ""
echo "🏗️  5/6: 빌드 및 데이터베이스 마이그레이션 중..."
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_IP" << ENDSSH
    cd $PROJECT_DIR
    
    # Prisma 마이그레이션
    echo "   📊 데이터베이스 마이그레이션 실행 중..."
    npx prisma migrate deploy
    npx prisma generate
    
    # 프로젝트 빌드
    echo "   🔨 프로젝트 빌드 중..."
    npm run build
    
    # 프로덕션 의존성만 남기기 (빌드 후)
    echo "   🧹 개발 의존성 제거 중..."
    npm prune --production
ENDSSH

echo "   ✅ 빌드 완료"

# 6. PM2로 서버 시작
echo ""
echo "🚀 6/6: 서버 시작 중..."
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_IP" << 'ENDSSH'
    cd sayitright-api
    
    # 기존 프로세스 중지
    pm2 stop sayitright-api 2>/dev/null || true
    pm2 delete sayitright-api 2>/dev/null || true
    
    # 새 프로세스 시작
    pm2 start dist/main.js --name sayitright-api
    
    # PM2 자동 시작 설정
    pm2 save
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
    
    # 상태 확인
    echo ""
    echo "📊 서버 상태:"
    pm2 status
    
    echo ""
    echo "📝 최근 로그:"
    pm2 logs sayitright-api --lines 20 --nostream
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 배포 완료!"
echo ""
echo "🌐 API URL: http://$EC2_IP:3001"
echo "🏥 헬스체크: http://$EC2_IP:3001/health"
echo ""
echo "📊 서버 관리 명령어:"
echo "   ssh -i ~/.ssh/sayitright-ec2-key.pem ubuntu@$EC2_IP"
echo "   pm2 status          # 상태 확인"
echo "   pm2 logs            # 로그 확인"
echo "   pm2 restart all     # 재시작"
echo ""
