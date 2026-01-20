import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
// Telas principais
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import ChooseProfileScreen from '../screens/ChooseProfileScreen';
// Estabelecimento
import EstablishmentRegisterScreen from '../screens/establishment/EstablishmentRegisterScreen';
import EstablishmentHomeScreen from '../screens/establishment/EstablishmentHomeScreen';
import CreateDeliveryScreen from '../screens/establishment/CreateDeliveryScreen';
import WaitingCourierScreen from '../screens/establishment/WaitingCourierScreen';
import DeliveryInProgressScreen from '../screens/establishment/DeliveryInProgressScreen';
import DeliveryHistoryScreen from '../screens/establishment/DeliveryHistoryScreen';
import EstablishmentProfileScreen from '../screens/establishment/EstablishmentProfileScreen';
// Entregador
import CourierRegisterScreen from '../screens/courier/CourierRegisterScreen';
import CourierHomeScreen from '../screens/courier/CourierHomeScreen';
import DeliveryDetailsScreen from '../screens/courier/DeliveryDetailsScreen';
import AcceptedDeliveryScreen from '../screens/courier/AcceptedDeliveryScreen';
import CourierHistoryScreen from '../screens/courier/CourierHistoryScreen';
import CourierProfileScreen from '../screens/courier/CourierProfileScreen';
// Admin
import AdminLoginScreen from '../screens/admin/AdminLoginScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminEstablishmentReport from '../screens/admin/AdminEstablishmentReport';
import AdminCourierReport from '../screens/admin/AdminCourierReport';

function SplashScreenWrapper() {
	const navigate = useNavigate();
	return (
		<SplashScreen
			onLogin={() => navigate('/login')}
			onRegister={() => navigate('/choose-profile')}
		/>
	);
}

function LoginScreenWrapper() {
	const navigate = useNavigate();
	return (
		<LoginScreen
			onLogin={(role) => {
				if (role === 'establishment') {
					navigate('/establishment/home');
				} else if (role === 'courier') {
					navigate('/courier/home');
				}
			}}
			onRegister={() => navigate('/choose-profile')}
		/>
	);
}

function ChooseProfileScreenWrapper() {
	const navigate = useNavigate();
	return (
		<ChooseProfileScreen
			onChoose={profile => {
				if (profile === 'establishment') {
					navigate('/establishment/register');
				} else {
					navigate('/courier/register');
				}
			}}
		/>
	);
}

function EstablishmentRegisterWrapper() {
	const navigate = useNavigate();
	return (
		<EstablishmentRegisterScreen
			onRegister={() => navigate('/establishment/home')}
			onBack={() => navigate('/choose-profile')}
		/>
	);
}

function CourierRegisterWrapper() {
	const navigate = useNavigate();
	return (
		<CourierRegisterScreen
			onRegister={() => navigate('/courier/home')}
			onBack={() => navigate('/choose-profile')}
		/>
	);
}

export default function AppRoutes() {
	return (
		<Router>
			<Routes>
				{/* Telas iniciais */}
				<Route path="/" element={<SplashScreenWrapper />} />
				<Route path="/login" element={<LoginScreenWrapper />} />
				<Route path="/choose-profile" element={<ChooseProfileScreenWrapper />} />

				{/* Fluxo Estabelecimento */}
				<Route path="/establishment/register" element={<EstablishmentRegisterWrapper />} />
				<Route path="/establishment/home" element={<EstablishmentHomeScreen />} />
				<Route path="/establishment/create-delivery" element={<CreateDeliveryScreen />} />
				<Route path="/establishment/waiting-courier" element={<WaitingCourierScreen />} />
				<Route path="/establishment/in-progress" element={<DeliveryInProgressScreen />} />
				<Route path="/establishment/history" element={<DeliveryHistoryScreen />} />
				<Route path="/establishment/profile" element={<EstablishmentProfileScreen />} />

				{/* Fluxo Entregador */}
				<Route path="/courier/register" element={<CourierRegisterWrapper />} />
				<Route path="/courier/home" element={<CourierHomeScreen />} />
				<Route path="/courier/delivery-details" element={<DeliveryDetailsScreen />} />
				<Route path="/courier/accepted" element={<AcceptedDeliveryScreen />} />
				<Route path="/courier/history" element={<CourierHistoryScreen />} />
				<Route path="/courier/profile" element={<CourierProfileScreen />} />

				{/* Fluxo Admin */}
				<Route path="/admin/login" element={<AdminLoginScreen />} />
				<Route path="/admin/dashboard" element={<AdminDashboardScreen />} />
				<Route path="/admin/reports/establishments" element={<AdminEstablishmentReport />} />
				<Route path="/admin/reports/couriers" element={<AdminCourierReport />} />
			</Routes>
		</Router>
	);
}
