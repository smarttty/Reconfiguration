import Component from '@ember/component';
import { computed } from '@ember/object';

export default Component.extend({
    powerColor : computed('data.currentPowerLevel', function(){
        let color = '';
        let level = this.data.currentPowerLevel;
        if(level > 75){
            color = 'green';
        }
        else if(level > 45){
            color = 'yellow';
        }
        else{
            color = 'red';
        }
        return color;
    }),
    cpuColor : computed('data.currentCPULevel', function(){
        let color = '';
        let level = this.data.currentCPULevel;
        if(level > 75){
            color = 'red';
        }
        else if(level > 45){
            color = 'yellow';
        }
        else{
            color = 'green';
        }
        return color;
    }),
});
