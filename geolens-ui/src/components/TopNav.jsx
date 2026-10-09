import React from 'react';
import { Link } from 'react-router-dom';

const NavLink = ({ to, currentPath, children }) => {
  const isActive = currentPath === to;
  return (
    <Link 
      to={to} 
      className={`bg-transparent text-mc-text border border-mc-border px-4 py-2 font-mono text-sm uppercase transition-all duration-200 hover:bg-mc-panel hover:text-mc-primary hover:border-mc-primary ${isActive ? 'bg-mc-panel text-mc-secondary border-mc-secondary shadow-sm' : ''}`}
    >
      {children}
    </Link>
  );
};

export default function TopNav({ currentPath }) {
  return (
    <nav className="flex gap-4 ml-8">
      <NavLink to="/" currentPath={currentPath}>DASHBOARD</NavLink>
      <NavLink to="/map-explorer" currentPath={currentPath}>MAP EXPLORER</NavLink>
      <NavLink to="/timelens" currentPath={currentPath}>TIMELENS</NavLink>
      <NavLink to="/reports" currentPath={currentPath}>REPORTS</NavLink>
      <NavLink to="/satellite-data" currentPath={currentPath}>SATELLITE DATA</NavLink>
      <NavLink to="/gov-papers" currentPath={currentPath}>GOV & RESEARCH</NavLink>
    </nav>
  );
}
