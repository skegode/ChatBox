// import './globals.css';
import {AuthProvider} from '../components/providers/AuthProvider';

export const metadata = {
  title: 'Customer Desk',
  description: 'Recruitement & Support',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Customer Desk | Recruitement & Support</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta content="Service Suite Customer Service Box" name="description" />
        <meta content="Themesbrand" name="author" />
        {/* App favicon */}
        <link rel="shortcut icon" href="/images/icon.png" />
        {/* magnific-popup css */}
        <link href="/libs/magnific-popup/magnific-popup.css" rel="stylesheet" type="text/css" />
        {/* owl.carousel css */}
        <link rel="stylesheet" href="/libs/owl.carousel/assets/owl.carousel.min.css" />
        <link rel="stylesheet" href="/libs/owl.carousel/assets/owl.theme.default.min.css" />
        {/* Bootstrap Css */}
        <link href="/css/bootstrap.min.css" id="bootstrap-style" rel="stylesheet" type="text/css" />
        {/* Icons Css */}
        <link href="/css/icons.min.css" rel="stylesheet" type="text/css" />
        {/* App Css */}
        <link href="/css/app.min.css" id="app-style" rel="stylesheet" type="text/css" />

        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css" />
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" async></script>
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}