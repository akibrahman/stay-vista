import { createBrowserRouter } from "react-router-dom";
import PaymentSuccess from "../components/Shared/PaymentSuccess";
import Dashboard from "../layouts/Dashboard/Dashboard";
import Main from "../layouts/Main";
import AddRoom from "../pages/AddRoom";
import DetailsPage from "../pages/DetailsPage/DetailsPage";
import ErrorPage from "../pages/ErrorPage";
import Home from "../pages/Home/Home";
import Login from "../pages/Login/Login";
import MyBookings from "../pages/MyBookings";
import MyPayments from "../pages/MyPayments";
import MyProfile from "../pages/MyProfile";
import SignUp from "../pages/SignUp/SignUp";
import UserPrivateRoute from "./UserPrivateRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Main />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/room/:id",
        element: (
          <UserPrivateRoute>
            <DetailsPage />
          </UserPrivateRoute>
        ),
      },
      {
        path: "/payment-success/:tranId",
        element: (
          <UserPrivateRoute>
            <PaymentSuccess />
          </UserPrivateRoute>
        ),
      },
    ],
  },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <SignUp /> },
  {
    path: "/dashboard",
    element: (
      <UserPrivateRoute>
        <Dashboard />
      </UserPrivateRoute>
    ),
    children: [
      //! Admin
      {
        path: "add-room",
        element: <AddRoom />,
      },
      //! User
      {
        path: "my-profile",
        element: <MyProfile />,
      },
      {
        path: "my-bookings",
        element: <MyBookings />,
      },
      {
        path: "my-payments",
        element: <MyPayments />,
      },
    ],
  },
]);
