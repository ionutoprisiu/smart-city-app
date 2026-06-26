import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@shared/components/Icon';

type Props = {
  title: string;
};

export const StackHeader: React.FC<Props> = ({ title }) => {
  const navigate = useNavigate();
  return (
    <header className="stack-header">
      <button type="button" className="icon-button" onClick={() => navigate(-1)}>
        <Icon name="arrow-back" size={24} />
      </button>
      <div className="header-title">{title}</div>
      <div style={{ width: 48 }} />
    </header>
  );
};
