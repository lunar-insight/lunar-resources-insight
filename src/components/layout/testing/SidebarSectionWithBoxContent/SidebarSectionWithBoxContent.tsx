import React from 'react'
import './SidebarSectionWithBoxContent.scss';
import { theme } from 'theme';
import SidebarSectionContainer, { SidebarSectionContainerProps } from '../../navigation/SidebarSectionContainer/SidebarSectionContainer';

const SidebarSectionWithBoxContent: React.FC<SidebarSectionContainerProps> = (props) => {

  return (
    <SidebarSectionContainer {...props}>
      
    </SidebarSectionContainer>
  )

};

export default SidebarSectionWithBoxContent;