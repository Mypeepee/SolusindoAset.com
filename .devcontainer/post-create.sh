#!/bin/bash
set -e

echo "🚀 Setting up Kosku project..."

# Install Node dependencies
echo "📦 Installing Node dependencies..."
npm install

# Setup Python backend
echo "🐍 Setting up Python environment..."
cd backend
pip install -r requirements.txt
cd ..

# Create .env files if they don't exist
if [ ! -f .env.local ]; then
  echo "📝 Creating .env.local..."
  cat > .env.local << 'EOF'
NEXT_PUBLIC_OCR_API_URL=http://localhost:8000
NEXTAUTH_SECRET=your-secret-key-change-this
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DATABASE_URL=postgresql://user:password@localhost:5432/kosku
EOF
fi

if [ ! -f backend/.env ]; then
  echo "📝 Creating backend/.env..."
  cat > backend/.env << 'EOF'
BACKEND_CORS_ORIGINS=http://localhost:3000
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-vision-credentials.json
EOF
fi

echo ""
echo "✅ Setup complete! Now you can:"
echo ""
echo "📱 From your phone/tablet:"
echo "  1. Go to https://github.com/codespaces"
echo "  2. Open the 'Kosku' codespace"
echo "  3. Install 'GitHub Copilot' + 'Claude' extensions"
echo ""
echo "💻 To start development:"
echo "  npm run dev      # Frontend on http://localhost:3000"
echo "  cd backend && python -m uvicorn app.main:app --reload  # Backend on http://localhost:8000"
echo ""
echo "🎯 Test OCR endpoint:"
echo "  curl -X POST http://localhost:8000/api/ocr/kwitansi -F 'file=@kwitansi.pdf'"
echo ""
