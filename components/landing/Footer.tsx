// components/landing/Footer.tsx
export default function Footer() {
  return (
    <div className="footer-alt py-3">
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="text-center">
              <p className="text-white-50 font-size-15 mb-0">
                © {new Date().getFullYear()} Powered by <a href="http://techcrast.co.ke">TechCrast LTD</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
}