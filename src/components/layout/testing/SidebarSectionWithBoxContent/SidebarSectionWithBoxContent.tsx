import React from 'react'
import './SidebarSectionWithBoxContent.scss';
import { theme } from 'theme';
import SidebarSectionContainer, { SidebarSectionContainerProps } from '../../navigation/SidebarSectionContainer/SidebarSectionContainer';
import BoxContentContainer, { BoxContentContainerProps } from '../../BoxContentContainer/BoxContentContainer';

interface SidebarSectionWithBoxContentProps {
  sidebarProps: SidebarSectionContainerProps;
  boxContentProps: BoxContentContainerProps;
}

const SidebarSectionWithBoxContent: React.FC<SidebarSectionWithBoxContentProps> = ({ sidebarProps, boxContentProps }) => {

  return (
    <div className="sidebar-section-with-box-content">
      <SidebarSectionContainer {...sidebarProps}>
        <BoxContentContainer {...boxContentProps}/>
      </SidebarSectionContainer>
    </div>
  )

};

export default SidebarSectionWithBoxContent;