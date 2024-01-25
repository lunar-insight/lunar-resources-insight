import React from 'react'
import './SidebarSectionWithBoxContent.scss';
import { theme } from 'theme';
import SidebarSectionContainer from '../../navigation/SidebarSectionContainer/SidebarSectionContainer';
import BoxContentContainer from '../../BoxContentContainer/BoxContentContainer';

const SidebarSectionWithBoxContent: React.FC = () => {

  return (
    <div className="sidebar-section-with-box-content">
      <SidebarSectionContainer>
        <BoxContentContainer flexible className="sidebar-section-with-box-content__box"/>
      </SidebarSectionContainer>
    </div>
  )
};

export default SidebarSectionWithBoxContent;