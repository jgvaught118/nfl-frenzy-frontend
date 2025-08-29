// src/pages/Privacy.jsx
import React from "react";

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-gray-700 mb-3">
        We collect only the information needed to run the NFL Frenzy game:
        your name, email, and your weekly picks. We do not sell your data.
      </p>
      <p className="text-gray-700">
        Questions? Contact{" "}
        <a href="mailto:support@nflfrenzy.app" className="text-blue-700 underline">
          support@nflfrenzy.app
        </a>.
      </p>
    </div>
  );
}
