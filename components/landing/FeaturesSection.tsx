// components/landing/FeaturesSection.tsx
export default function FeaturesSection() {
  return (
    <section className="section landing-features">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-4 align-self-center">
            <div className="mb-4 mb-lg-0">
              <img src="/images/features.svg" alt="" className="img-fluid d-block mx-auto" />
              <h3>Why Choose Customer Desk?</h3>
              <p className="text-muted mb-4">Discover powerful tools that transform WhatsApp into your company’s customer support hub.</p>
            </div>
          </div>
          <div className="col-lg-8 align-self-center">
            <div className="row">
              <div className="col-md-6">
                <div className="wc-box rounded text-center wc-box-primary p-4 mt-md-5">
                  <div className="wc-box-icon">
                    <i className="mdi mdi-collage" />
                  </div>
                  <h5 className="fw-bold mb-2 wc-title mt-4">Unified WhatsApp Inbox</h5>
                  <p className="text-muted mb-0 font-size-15 wc-subtitle">Manage all client conversations in one secure, easy-to-use dashboard.</p>
                </div>
                <div className="wc-box rounded text-center wc-box-primary p-4">
                  <div className="wc-box-icon">
                    <i className="mdi mdi-trending-up" />
                  </div>
                  <h5 className="fw-bold mb-2 wc-title mt-4">Smart Reply & Automation</h5>
                  <p className="text-muted mb-0 font-size-15 wc-subtitle">Save time with AI-powered quick replies and automated workflows.</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="wc-box rounded text-center wc-box-primary p-4">
                  <div className="wc-box-icon">
                    <i className="mdi mdi-security" />
                  </div>
                  <h5 className="fw-bold mb-2 wc-title mt-4">Recruitment via Influencers</h5>
                  <p className="text-muted mb-0 font-size-15 wc-subtitle">Onboard new customers through influencer-driven WhatsApp campaigns.</p>
                </div>
                <div className="wc-box rounded text-center wc-box-primary p-4">
                  <div className="wc-box-icon">
                    <i className="mdi mdi-database-lock" />
                  </div>
                  <h5 className="fw-bold mb-2 wc-title mt-4">Centralized History</h5>
                  <p className="text-muted mb-0 font-size-15 wc-subtitle">Store and search past conversations for better customer service</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}