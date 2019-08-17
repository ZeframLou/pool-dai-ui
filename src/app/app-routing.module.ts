import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MainComponent } from './main/main.component';
import { CreateComponent } from './create/create.component';

const routes: Routes = [
  {
    path: '',
    component: MainComponent
  },
  {
    path: 'create',
    component: CreateComponent,
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
