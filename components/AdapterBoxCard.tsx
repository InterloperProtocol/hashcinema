"use client";

import { InterfaceAdapterServiceManifest } from "@/packages/core/src/protocol";

interface AdapterBoxCardProps {
  service: InterfaceAdapterServiceManifest;
}

export function AdapterBoxCard({ service }: AdapterBoxCardProps) {
  return (
    <section className="hyperflow-card adapter-box-card">
      <div className="hyperflow-card-header">
        <div>
          <p className="eyebrow">Adapter Box</p>
          <h3>Plug this into any interface</h3>
        </div>
      </div>

      <p className="route-summary compact">
        {service.summary}
      </p>

      <div className="adapter-box-grid">
        <article className="rail-card">
          <p className="eyebrow">Create</p>
          <strong>{service.endpoints.createJob}</strong>
          <span>Manual SOL checkout for the same low-price packages.</span>
        </article>
        <article className="rail-card">
          <p className="eyebrow">x402</p>
          <strong>{service.endpoints.x402}</strong>
          <span>USDC settlement surface for agents and hosted interfaces.</span>
        </article>
        <article className="rail-card">
          <p className="eyebrow">Manifest</p>
          <strong>{service.endpoints.manifest}</strong>
          <span>Machine-readable service descriptor for embedders.</span>
        </article>
      </div>

      <div className="mini-list">
        {service.adapters.map((adapter) => (
          <article key={adapter.id} className="mini-item-card">
            <div>
              <span>{adapter.kind}</span>
              <strong>
                {adapter.label} / {adapter.currency}
              </strong>
            </div>
            <p className="route-summary compact">{adapter.endpoint}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
