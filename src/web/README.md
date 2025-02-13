# Sales Intelligence Platform - Web Frontend

Enterprise-grade web application for AI-powered digital advertising campaign management.

## Technologies

- Next.js v14.0.0
- React v18.2.0
- TypeScript v5.0.0
- Redux Toolkit v2.0.0
- Tailwind CSS v3.3.0
- D3.js v7.8.0

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure environment variables by creating a `.env.local` file:
```bash
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID=
NEXT_PUBLIC_LINKEDIN_ADS_CLIENT_ID=
NEXT_PUBLIC_ANALYTICS_KEY=
NEXT_PUBLIC_SENTRY_DSN=
```

## Development

### Available Commands

```bash
# Start development server
npm run dev

# Build production bundle
npm run build

# Start production server
npm run start

# Run linting
npm run lint

# Run type checking
npm run type-check

# Run tests
npm run test

# Run tests with watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Format code
npm run format
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── features/      # Feature-specific components and logic
│   ├── campaigns/
│   ├── analytics/
│   ├── targeting/
│   └── creative/
├── hooks/         # Custom React hooks
├── lib/          # Third-party library configurations
├── pages/        # Next.js pages
├── store/        # Redux store configuration
├── styles/       # Global styles and Tailwind configuration
├── types/        # TypeScript type definitions
└── utils/        # Utility functions
```

## Performance Optimization

The application is optimized to achieve <100ms latency targets through:

- Code splitting and lazy loading
- Image optimization with next/image
- Static page generation where possible
- Client-side data caching
- Optimized bundle sizes with webpack configuration
- Performance monitoring with Sentry

## Testing

- Unit tests with Jest and React Testing Library
- Integration tests with Jest
- Accessibility testing with jest-axe
- End-to-end testing with Cypress

## Security

Security measures implemented:

- Strict CSP headers
- HTTPS enforcement
- XSS protection
- CSRF protection
- Input sanitization
- Secure authentication with NextAuth.js
- Regular dependency updates

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| NEXT_PUBLIC_API_URL | Backend API URL | Yes |
| NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID | Google Ads API client ID | Yes |
| NEXT_PUBLIC_LINKEDIN_ADS_CLIENT_ID | LinkedIn Ads API client ID | Yes |
| NEXT_PUBLIC_ANALYTICS_KEY | Analytics service key | Yes |
| NEXT_PUBLIC_SENTRY_DSN | Sentry error tracking DSN | Yes |

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Verify the build:
```bash
npm run start
```

3. Deploy using your preferred hosting platform (Vercel recommended)

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## Troubleshooting

### Common Issues

1. Build failures
- Verify Node.js version (>=18.0.0)
- Clear `.next` directory
- Delete `node_modules` and reinstall

2. Type errors
- Run `npm run type-check`
- Update TypeScript definitions
- Verify import paths

3. Performance issues
- Check bundle analyzer report
- Verify image optimization
- Monitor API response times

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

### Code Style

- Follow ESLint configuration
- Use Prettier for formatting
- Follow TypeScript strict mode guidelines
- Write comprehensive tests
- Document new features

## License

Proprietary - All rights reserved