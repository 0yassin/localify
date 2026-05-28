import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';
import "../../global.css";

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1DB954',   // Active color (Spotify Green)
        tabBarInactiveTintColor: '#a7a7a7', 
        headerShown: false,                 
        
        tabBarStyle: {
          // backgroundColor: '#121212',       
          // borderTopWidth: 1,
          // borderTopColor: '#282828',        
          // height: 64,                      
          // paddingBottom: 10,
          // paddingTop: 8,
          display:'none'
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        }
      }}
    >
      {/* Main Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />

      <Tabs.Screen
        name="playlist/[id]"
        options={{
          href: null,
        }}
      />

    </Tabs>
  );
}