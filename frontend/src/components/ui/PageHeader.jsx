import React from 'react';

export default function PageHeader({ title, subtitle, icon, badge, actions }) {
  return (
    <div className="portal-header">
      <div>
        <h2 className="portal-header-title">
          {icon && <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>{icon}</span>}
          <span>{title}</span>
          {badge && <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{badge}</span>}
        </h2>
        {subtitle && <p className="portal-header-subtitle">{subtitle}</p>}
      </div>

      {actions && (
        <div className="portal-header-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
